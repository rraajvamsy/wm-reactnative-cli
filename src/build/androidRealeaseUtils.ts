import { BuildConfig } from "../config/buildConfig";
import fs from 'fs-extra';
import { logger } from "../utils/logger";
import { exec } from '../utils/exec';

export class ReleaseUtils{
    buildConfig: BuildConfig;
    constructor(config: BuildConfig){
        this.buildConfig = config;
    }

    updateOptimizationFlags() {
        logger.info('***** into optimization ******')
        const buildGradlePath = this.buildConfig.config.src + 'android/app/build.gradle';
        if (fs.existsSync(buildGradlePath)) {
            let content = fs.readFileSync(buildGradlePath, 'utf8');
            if (content.search(`def enableProguardInReleaseBuilds = false`) > -1) {
                content = content.replace(/def enableProguardInReleaseBuilds = false/gm, `def enableProguardInReleaseBuilds = true`)
                    .replace(/minifyEnabled enableProguardInReleaseBuilds/gm, `minifyEnabled enableProguardInReleaseBuilds\n shrinkResources false\n`);
            }
            fs.writeFileSync(buildGradlePath, content);
        }
    }

    setKeyStoreValuesInGradleProps(content, keystoreName, ksData) {
        // TODO: if key pwds are changed, then just update the values.
        if(content.search(/MYAPP_UPLOAD_STORE_PASSWORD/gm) == -1) {
            return content.concat(` \n MYAPP_UPLOAD_STORE_FILE=${keystoreName}
            MYAPP_UPLOAD_KEY_ALIAS=${ksData.keyAlias}
            MYAPP_UPLOAD_STORE_PASSWORD=${ksData.storePassword}
            MYAPP_UPLOAD_KEY_PASSWORD=${ksData.keyPassword}`);
        }
        return content;
    }

    addProguardRule() {
        const proguardRulePath = this.buildConfig.config.src + 'android/app/proguard-rules.pro';
        if (fs.existsSync(proguardRulePath)) {
            var data = `-keep class com.facebook.react.turbomodule.** { *; }`;
            fs.appendFileSync(proguardRulePath,data, 'utf8');
            logger.info('***** added proguard rule ******')
        }
    }
    
    updateSigningConfig(content) {
        // TODO: replace one of the buildTypes to signingConfigs.release
        if(content.search(/if \(project.hasProperty\(\'MYAPP_UPLOAD_STORE_FILE\'\)\)/gm) == -1) {
            content = content.replace(/signingConfigs\.debug/g, 'signingConfigs.release');
            return content.replace(/signingConfigs \{/gm, `signingConfigs {
                release {
                    if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                        storeFile file(MYAPP_UPLOAD_STORE_FILE)
                        storePassword MYAPP_UPLOAD_STORE_PASSWORD
                        keyAlias MYAPP_UPLOAD_KEY_ALIAS
                        keyPassword MYAPP_UPLOAD_KEY_PASSWORD
                    }
                }`);
        }
        return content;
    }
    
    async generateAab() {
        try {
            // addKeepFileEntries();
            await exec('./gradlew', ['clean'], {
                cwd: this.buildConfig.config.src + 'android'
            });
            logger.info('****** invoking aab build *****');
            if (this.buildConfig.config.packageType === 'bundle') {
                await exec('./gradlew', [':app:bundleRelease'], {
                    cwd: this.buildConfig.config.src + 'android'
                });
            } else {
                await exec('./gradlew', ['assembleRelease'], {
                    cwd: this.buildConfig.config.src + 'android'
                });
            }
        }
        catch(e) {
            console.error('error generating release apk. ', e);
            return {
                success: false,
                errors: e
            }
        }
    }

    async generateSignedApk() {
        const ksData = {storePassword: this.buildConfig.config.aStorePassword, keyAlias: this.buildConfig.config.aKeyAlias, keyPassword: this.buildConfig.config.aKeyPassword};
        const namesArr = this.buildConfig.config.aKeyStore.split('/');
        const keystoreName = namesArr[namesArr.length - 1];
        const filepath = this.buildConfig.config.src + 'android/app/' + keystoreName;
    
        fs.copyFileSync(this.buildConfig.config.aKeyStore, filepath);
    
        // edit file android/gradle.properties
        const gradlePropsPath = this.buildConfig.config.src + 'android/gradle.properties';
        if (fs.existsSync(gradlePropsPath)) {
            let data = fs.readFileSync(gradlePropsPath, 'utf8');
            let content = await this.setKeyStoreValuesInGradleProps(data, keystoreName, ksData);
            fs.writeFileSync(gradlePropsPath, content);
        }
    
        const appGradlePath = this.buildConfig.config.src + 'android/app/build.gradle';
        let content = fs.readFileSync(appGradlePath, 'utf8');
        content = await this.updateSigningConfig(content);
        fs.writeFileSync(appGradlePath, content);
        await this.generateAab();
    }
}