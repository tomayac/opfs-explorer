<img src="https://raw.githubusercontent.com/tomayac/opfs-explorer/main/icon.svg" alt="OPFS Explorer icon." width="128" height="128">

# OPFS Explorer

OPFS Explorer is a Chrome DevTools extension that allows you to explore the
[Origin Private File System](https://fs.spec.whatwg.org/) (OPFS) of a web
application.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/tomayac/opfs-explorer/blob/main/store-assets/dark.png?raw=true">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/tomayac/opfs-explorer/blob/main/store-assets/light.png?raw=true">
  <img alt="OPFS Explorer extension showing the file hierarchy of a sample application." src="https://github.com/tomayac/opfs-explorer/blob/main/store-assets/light.png?raw=true">
</picture>

## Installation

Install the extension from the
[Chrome Web Store](https://chrome.google.com/webstore/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd)
(end users) or clone the repo and
[load the unpacked extension locally](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked)
(developers).

## Usage

Open Chrome DevTools and click on the **OPFS Explorer** tab. The extension will
automatically analyze the OPFS of the current web application and display the
file hierarchy. You can then click on any file to **download** its contents or
**delete** the file (which may fail if the file is locked). Note that deleting
files may cause the application to break.

## Trying the extension

You can test the extension on the
[demo page](https://tomayac.github.io/opfs-explorer/).

## FAQ

- **The OPFS Explorer tab has disappeared from DevTools, what do I do?**

  This happens occasionally and can be fixed by clicking **Restore defaults and
  reload** in DevTools settings:

  ![](https://github.com/tomayac/opfs-explorer/assets/145676/2143e1e9-0752-41ad-92c3-1d51af5a2c6e)

## License

Apache 2.0

## Acknowledgements

Extension icon courtesy of the
[WHATWG](https://resources.whatwg.org/logo-fs.svg), used under a
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
