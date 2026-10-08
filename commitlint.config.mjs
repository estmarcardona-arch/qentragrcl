// Convención de commits (AGENTS.md regla 13): tipo(alcance): resumen, en español.
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // El resumen va en español y puede empezar con mayúscula o con siglas (RLS, SOD, PRD…).
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
