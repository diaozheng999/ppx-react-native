const fs = require("fs");
const path = require("path");
const cwd = path.resolve(path.join(__dirname, ".."));

const toplevel_file_list = fs.readdirSync(cwd)

let ppx_name

for (const file of toplevel_file_list) {
  if (file.endsWith(".opam")) {
    ppx_name = file.replace(".opam", "")
  }
}

if (!ppx_name) {
  console.error("Cannot find `.opam` file in top level.")
  process.exit(1)
}

const esy_ppx_exe = [
  "build",
  "lib",
  ppx_name,
  "ppx.exe",
];
const src = path.resolve(cwd, ...esy_ppx_exe);
const dst = path.resolve(cwd, "ppx.exe")

console.log(`Copying ${src} to ${dst}...`);
fs.copyFileSync(path.resolve(cwd, ...esy_ppx_exe), path.resolve(cwd, "ppx.exe"));
