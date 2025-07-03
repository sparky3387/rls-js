# Rls-JS Parser for Node.js

A comprehensive release name parser for Node.js, ported from the Go [rls](https://github.com/moistari/rls/) library. That AutoBRR uses.

## Installation

```bash
npm install rls-parser
```
## Usage

The library exports an `Rls` class. You should create an instance of this class and reuse it to parse release names.

### Full Parse

```javascript
const { Rls, ReleaseType } = require('./rls');

const rls = new Rls();

const title = "The.Creator.2023.PROPER.UHD.WEB-DL.2160p.HEVC.DV.HDR.EAC3.7.1.DL.Remux-TvR";
const release = rls.parseRelease(title);

console.log('--- Full Parse ---');
console.log('Type:', release.type);         // movie
console.log('Title:', release.title);       // The Creator
console.log('Year:', release.year);         // 2023
console.log('Resolution:', release.resolution); // 2160p
console.log('Source:', release.source);     // UHD.WEB-DL
console.log('Codec:', release.codec);       // [ 'HEVC' ]
console.log('Group:', release.group);       // TvR
console.log('Other:', release.other);       // [ 'PROPER', 'REMUX' ]
```

### Fast "Type-Only" Parse

If you only need to determine the type of the release (e.g., for routing files) and don't need all the metadata, you can use the `typeOnly` option for a faster result. This skips the expensive title and unused-tag analysis.

```javascript
const { Rls } = require('./rls');

const rls = new Rls();

const title = "The.Creator.2023.PROPER.UHD.WEB-DL.2160p.HEVC.DV.HDR.EAC3.7.1.DL.Remux-TvR";

// Pass the typeOnly option
const release = rls.parseRelease(title, { typeOnly: true });

console.log('\n--- Type-Only Parse ---');
console.log('Type:', release.type); // 'movie'
// Other fields may be empty or partially filled, but the type is reliable.
console.log('Title:', release.title); // '' (Title processing is skipped)
```

## Running Tests

To run the integrated test suite, you need the `tests.yaml` file from the original project. Place it in the root directory and run:

```bash
npm test
```

Or to run verbosely
```bash
npm test -- --verbose
```
