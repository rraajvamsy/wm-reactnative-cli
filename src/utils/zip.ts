const { isWindowsOS } = require('./utils');
const { exec } = require('./exec');
const extract = require('extract-zip');
import os from 'os';
import { exec } from './exec';

function isWindowsOS() {
    return (os.platform() === "win32");
}

export async function unzip(src: string, dest: string) {
    if ( isWindowsOS() ) {
        await extract(src, { dir: dest});
    } else {
        await exec('unzip', [
            '-o', src, '-d', dest
        ], {
            log: false
        });
    }
}