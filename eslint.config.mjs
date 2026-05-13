import js from "@eslint/js";
import security from "eslint-plugin-security";

export default [
    js.configs.recommended,
    security.configs.recommended,
    {
        rules: {
            // Dangerous function execution
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",

            // Prototype pollution guards
            "no-proto": "error",
            "no-extend-native": "error",

            // Catch obvious mistakes that strict mode may not cover
            "no-var": "warn",
            "prefer-const": "warn",

            // Allow console in a CLI/bot context
            "no-console": "off",
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                Buffer: "readonly",
                setInterval: "readonly",
                setTimeout: "readonly",
                clearInterval: "readonly",
                clearTimeout: "readonly",
                setImmediate: "readonly",
                console: "readonly",
            }
        },
        ignores: ["node_modules/**", "docs/**"],
    }
];
