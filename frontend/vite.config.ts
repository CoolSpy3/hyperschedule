import * as path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

// list of usernames to exclude from contributors
const maintainerGithubUsernames: string[] = [
    "stuxf",
    "NextZtepS",
    "edonson2016",
    "mia1024",
    "kwshi",
    "raxod502",
];
let contributors: string;
try {
    const fileData = JSON.parse(
        readFileSync(path.resolve(__dirname, "contributors.json"), {
            encoding: "utf-8",
        }),
    );
    contributors = JSON.stringify(
        fileData.filter(
            ({ username }) => !maintainerGithubUsernames.includes(username),
        ),
    );
} catch {
    contributors = JSON.stringify([
        {
            username: "",
            name: "Contributor placeholder (run `yarn get-contributor` then restart frontend)",
        },
    ]);
}

// fix the weird thing with use-sync-external-store, imported by both zustand and react-query
// this is only needed for production build. this module doesn't even matter because we are
// already using react 18
let useSyncExternalStoreFix = {};
if (process.env.NODE_ENV === "production") {
    useSyncExternalStoreFix = {
        "use-sync-external-store/shim": path.dirname(
            require.resolve("use-sync-external-store"),
        ),
    };
}

const allocatedCssNumbers = new Map<string, number>();
let cssClassCounter = 0;

// generate a css class name. this function needs to be deterministic (hence the map)
function generateCssClassName(classname: string, filename: string) {
    // if we somehow managed have more than 2^32 css classes there are way more serious problems

    const indexString = filename + "__" + classname;
    let n: number | undefined = allocatedCssNumbers.get(indexString);
    if (n === undefined) {
        n = cssClassCounter++;
        allocatedCssNumbers.set(indexString, n);
    }

    const arr = new Uint32Array(1);
    arr[0] = n;
    const s = Buffer.from(arr).toString("base64url");
    if (s.match(/^\d/)) return "_" + s;
    return s;
}

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        root: "src",
        envDir: __dirname,
        publicDir: path.resolve(__dirname, "dist"),
        cacheDir: path.resolve(__dirname, "..", "node_modules", ".vite"),
        plugins: [react()],
        define: {
            // we need to use JSON.stringify to quote them because this is basically text replacement
            __API_URL__: JSON.stringify(env.HYPERSCHEDULE_API_URL),
            __CONTRIBUTOR_GH_NAMES__: contributors,
        },
        resolve: {
            extensions: [".ts", ".tsx"],
            alias: {
                "@components": path.join(__dirname, "src/components"),
                "@lib": path.join(__dirname, "src/lib"),
                "@hooks": path.join(__dirname, "src/hooks"),
                "@css": path.join(__dirname, "src/css"),
                ...useSyncExternalStoreFix,
            },
        },
        css: {
            modules: {
                generateScopedName:
                    process.env.NODE_ENV !== "production"
                        ? "[local]__[path][name]"
                        : generateCssClassName,
            },
        },
        ssr: { external: ["@babel/runtime"] },
        build: {
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    app: "src/index.html",
                    json: "src/data-viewer/data-viewer.html",
                    sw: "src/service-worker/sw.ts",
                },
                output: {
                    entryFileNames: "[name].js",
                    assetFileNames: "[name].[ext]",
                },
            },
            copyPublicDir: false,
            outDir: path.resolve(__dirname, "dist"),
            sourcemap: true,
        },
        server: {
            port: 5000,
            host: true,
        },
    };
});
