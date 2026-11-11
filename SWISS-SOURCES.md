# Swiss Ephemeris dependency sources

The Wix integration uses the npm release **sweph-wasm 2.6.9**, whose runtime reports **Swiss Ephemeris 2.10.03**. It calls the Moshier ephemeris in Lahiri sidereal mode.

- npm release metadata: https://registry.npmjs.org/sweph-wasm/2.6.9
- Wrapper source at the npm release's gitHead: https://github.com/ptprashanttripathi/sweph-wasm/tree/0583463e4c4f4791e19f2a9f1962d2d965e021ab
- Build scripts from that revision: https://github.com/ptprashanttripathi/sweph-wasm/tree/0583463e4c4f4791e19f2a9f1962d2d965e021ab/build_tool
- Exact Swiss Ephemeris C submodule recorded in that revision: https://github.com/aloistr/swisseph/tree/fa78b5065810fa9077e96475e33decb8f3ecd61c
- Exact WASM download used by Wix: https://cdn.jsdelivr.net/npm/sweph-wasm@2.6.9/dist/wasm/swisseph.wasm
- Wrapper license: see LICENSE-sweph-wasm.txt.
- Swiss Ephemeris notice: https://github.com/aloistr/swisseph/blob/fa78b5065810fa9077e96475e33decb8f3ecd61c/LICENSE

To inspect the complete upstream build tree, clone the wrapper, check out the pinned revision, and run git submodule update --init --recursive. Follow the build scripts and README in that checkout for Node.js, Python and Emscripten requirements. This draft records upstream source locations and versions. A rebuild of the npm WASM and a byte-for-byte comparison have not been performed.
