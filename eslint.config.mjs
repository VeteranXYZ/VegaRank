import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".data/.tmp/**", ".open-next/**", ".tmp/test/**", ".wrangler/**"],
  },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
