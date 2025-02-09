import path from "path";
import { updateHtmlFilesInFolder } from "./utils/htmlManipulation";

console.log("Running HTML file processor...");

updateHtmlFilesInFolder(path.join("./src/Library"))
    .then(() => console.log("Processing complete."))
    .catch(error => console.error(`Error: ${error}`));
