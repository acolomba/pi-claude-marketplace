// Throwaway probe: no test covers this file, so Sonar must report it uncovered.

export function classifySonarProbe(value: number): string {
  if (value < 0) {
    return "negative";
  }

  if (value === 0) {
    return "zero";
  }

  return "positive";
}
