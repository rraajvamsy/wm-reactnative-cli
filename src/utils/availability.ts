import fs from 'fs-extra';
import { logger } from "../utils/logger";
import { exec } from '../utils/exec';
import { Versions } from '../config/configTypes';
import semver from 'semver';
import os from 'os';

export class Availability{
    versions: Versions;
    constructor(){
        this.versions = {
            'NODE': '14.0.0',
            'POD' : '1.9.0',
            'JAVA': '11.0.0',
            'REACT_NATIVE': '0.68.2',
            'EXPO': '5.4.4',
        }
    }
    async checkAvailability(cmd: string, transformFn?: Function, projectSrc?: string) {
        try {
            let options = {};
            if (projectSrc) {
                options = {
                    cwd: projectSrc
                }
            }
            let output = (await exec(cmd, ['--version']) as any).join('');
    
            if (transformFn) {
                output = transformFn(output);
            }
            // to just return version in x.x.x format
            let version = output.match(/[0-9]+\.[0-9\.]+/)[0];
    
            logger.info({
                'label': 'check-availability',
                'message': cmd + ' version available is ' + version
            })
            const requiredVersion = this.versions[cmd.toUpperCase()];
            version = semver.coerce(version).version;
            if (requiredVersion && semver.lt(version, requiredVersion)) {
                logger.error('Minimum ' + cmd + ' version required is ' + requiredVersion + '. Please update the version.');
                return false;
            }
            return version;
        } catch(e) {
            console.error(e);
            logger.error('Observing error while checking ' + cmd.toUpperCase() + ' availability');
            return false;
        }
    }
    
    async checkForGradleAvailability() {
        return await this.checkAvailability('gradle', o => o && o.substring(o.indexOf('Gradle')) );
    }
    
    async checkForAndroidStudioAvailability() {
        // ANDROID_HOME environment variable is set or not. If it is set checking if its a valid path or no.
        const ANDROID_HOME = process.env['ANDROID_HOME'];
        const ANDROID_SDK_ROOT = process.env['ANDROID_SDK_ROOT']
        if (ANDROID_HOME && !ANDROID_SDK_ROOT) {
            logger.warn({
                'label': 'check-android-studio',
                'message': 'ANDROID_HOME is deprecated. Recommended to set ANDROID_SDK_ROOT'
            });
        }
        let envVariable = ANDROID_SDK_ROOT || ANDROID_HOME;
        if (!envVariable) {
            logger.error({
                'label': 'check-android-studio',
                'message': 'Failed to find \'ANDROID_SDK_ROOT\' environment variable. Try setting it manually.\n' +
                'Try update your \'PATH\' to include path to valid SDK directory.'});
            return false;
        }
        if (!fs.existsSync(envVariable)) {
            logger.error({
                'label': 'check-android-studio',
                'message': '\'ANDROID_HOME\' environment variable is set to non-existent path: ' + process.env['ANDROID_HOME'] +
                '\nTry update it manually to point to valid SDK directory.'});
            return false;
        }
        let sdkPath = envVariable + '/tools/bin/sdkmanager';
    
        // file extension has to be added for windows os for existsSync to work.
        sdkPath = os.type().includes('Windows') ? sdkPath + '.bat' : sdkPath;
    
        if (fs.existsSync(sdkPath)) {
            logger.info({
                'label': 'check-android-studio',
                'message': 'Found Android SDK manager at ' + sdkPath
            });
            try {
                await exec(sdkPath, ['--list']);
            } catch(e) {
                console.warn(e);
            }
        } else {
            logger.warn({
                'label': 'check-android-studio',
                'message': 'Failed to find \'android-sdk\' in your \'PATH\'. Install Android-Studio before proceeding to build.'});
        }
        return true;
    }
}