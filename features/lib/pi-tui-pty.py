#!/usr/bin/env python3
"""Run one command with its stdio attached to a real pseudoterminal."""

from __future__ import annotations

import os
import pty
import select
import signal
import struct
import sys
import termios
import fcntl
from collections.abc import Sequence


READY_PREFIX = "PI_TUI_PTY_READY"


def command_arguments(arguments: Sequence[str]) -> list[str]:
    if len(arguments) < 2 or arguments[0] != "--":
        raise ValueError("usage: pi-tui-pty.py -- command [argument ...]")
    return list(arguments[1:])


def set_terminal_size(file_descriptor: int) -> None:
    size = struct.pack("HHHH", 40, 120, 0, 0)
    fcntl.ioctl(file_descriptor, termios.TIOCSWINSZ, size)


def relay(master: int, child: int) -> int:
    stdin_open = True
    while True:
        readable = [master]
        if stdin_open:
            readable.append(sys.stdin.fileno())
        ready, _, _ = select.select(readable, [], [], 0.1)

        if master in ready:
            try:
                output = os.read(master, 65_536)
            except OSError:
                output = b""
            if output:
                os.write(sys.stdout.fileno(), output)
            else:
                break

        if stdin_open and sys.stdin.fileno() in ready:
            input_bytes = os.read(sys.stdin.fileno(), 65_536)
            if input_bytes:
                os.write(master, input_bytes)
            else:
                stdin_open = False

        completed, status = os.waitpid(child, os.WNOHANG)
        if completed == child:
            while True:
                try:
                    output = os.read(master, 65_536)
                except OSError:
                    break
                if not output:
                    break
                os.write(sys.stdout.fileno(), output)
            return os.waitstatus_to_exitcode(status)

    _, status = os.waitpid(child, 0)
    return os.waitstatus_to_exitcode(status)


def main(arguments: Sequence[str]) -> int:
    command = command_arguments(arguments)
    master, slave = pty.openpty()
    try:
        if not os.isatty(slave):
            raise RuntimeError("the allocated PTY slave is not interactive")
        set_terminal_size(slave)
        child = os.fork()
        if child == 0:
            os.close(master)
            os.dup2(slave, sys.stdin.fileno())
            os.dup2(slave, sys.stdout.fileno())
            os.dup2(slave, sys.stderr.fileno())
            if slave > sys.stderr.fileno():
                os.close(slave)
            os.execvp(command[0], command)

        os.close(slave)
        slave = -1
        os.write(sys.stderr.fileno(), f"{READY_PREFIX} child={child} isatty=true\n".encode())
        return relay(master, child)
    finally:
        os.close(master)
        if slave >= 0:
            os.close(slave)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    raise SystemExit(main(sys.argv[1:]))
