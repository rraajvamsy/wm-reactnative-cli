import { BuildConfig } from "../config/buildConfig";
import propertiesReader from 'properties-reader';
import fs from 'fs-extra';
import { logger } from "../utils/logger";
import { exec } from '../utils/exec';

export class Embed{
    buildConfig: BuildConfig;
    constructor(config: BuildConfig){
        this.buildConfig = config;
    }

    async  iosEmbed() {
        const rnIosProject = this.buildConfig.config.src;
        const embedProject = `${rnIosProject}ios-embed`;
        fs.copySync(this.buildConfig.config.modulePath, embedProject);
        const rnModulePath = `${embedProject}/rnApp`;
        fs.removeSync(rnModulePath);
        fs.mkdirpSync(rnModulePath);
        fs.copyFileSync(`${__dirname}/../templates/embed/ios/ReactNativeView.swift`, `${rnModulePath}/ReactNativeView.swift`);
        fs.copyFileSync(`${__dirname}/../templates/embed/ios/ReactNativeView.h`, `${rnModulePath}/ReactNativeView.h`);
        fs.copyFileSync(`${__dirname}/../templates/embed/ios/ReactNativeView.m`, `${rnModulePath}/ReactNativeView.m`);
        await this.buildConfig.readAndReplaceFileContent(
            `${rnIosProject}/app.js`,
            (content) => content.replace('props = props || {};', 'props = props || {};\n\tprops.landingPage = props.landingPage || props.pageName;'));
        await this.buildConfig.readAndReplaceFileContent(
            `${rnIosProject}/node_modules/expo-splash-screen/build/SplashScreen.js`,
            (content) => {
                return content.replace('return await ExpoSplashScreen.preventAutoHideAsync();', 
                `
                // return await ExpoSplashScreen.preventAutoHideAsync();
                return Promise.resolve();
                `).replace('return await ExpoSplashScreen.hideAsync();', 
                `
                // return await ExpoSplashScreen.hideAsync();
                return Promise.resolve();
                `)
            }
        )
        await exec('npx', ['react-native', 'bundle', '--platform',  'ios',
                '--dev', 'false', '--entry-file', 'index.js',
                '--bundle-output', 'ios-embed/rnApp/main.jsbundle',
                '--assets-dest', 'ios-embed/rnApp'], {
            cwd: this.buildConfig.config.src
        });
        await exec('pod', ['install'], {
            cwd: embedProject
        });
        logger.info({
            label: 'ios-embed',
            message: 'Changed Native Ios project.'
        });
    }

    async  androidEmbed() {
        const rnAndroidProject = `${this.buildConfig.config.src}/android`;
        const embedAndroidProject = `${this.buildConfig.config.src}/android-embed`;
        fs.mkdirpSync(embedAndroidProject);
        logger.info({
            label: 'android-embed',
            message: 'copying Native Android project.'
        });
        fs.copySync(this.buildConfig.config.modulePath, embedAndroidProject);
        fs.copySync(
            `${__dirname}/../templates/embed/android/fragment_react_native_app.xml`,
            `${embedAndroidProject}/rnApp/src/main/res/layout/fragment_react_native_app.xml`);
        fs.copySync(
            `${__dirname}/../templates/embed/android/ReactNativeAppFragment.java`,
            `${embedAndroidProject}/app/src/main/java/com/wavemaker/reactnative/ReactNativeAppFragment.java`);
        await this.buildConfig.readAndReplaceFileContent(
            `${embedAndroidProject}/app/src/main/java/com/wavemaker/reactnative/ReactNativeAppFragment.java`, 
            content => content.replace(/\$\{packageName\}/g, this.buildConfig.config.metaData.id));
        logger.info({
            label: 'android-embed',
            message: 'transforming Native Android files.'
        });
        await this.buildConfig.readAndReplaceFileContent(`${embedAndroidProject}/app/build.gradle`, 
            // TODO: This is a workaround to get build passed. Need to find appropriate fix.
            content => content.replace(/android[\s]{/, `project.ext.react = [
                enableHermes: true
            ];
            android {`));
                // fix for issue at https://github.com/facebook/react-native/issues/33926
                //.replace(/(com\.google\.android\.material:material:([\d\.]*))/, 'com.google.android.material:material:1.6.0'));
        logger.info({
            label: 'android-embed',
            message: 'Changed Native Android project.'
        });
        fs.copySync(`${rnAndroidProject}/app`, `${embedAndroidProject}/rnApp`);
        fs.copySync(`${rnAndroidProject}/build.gradle`, `${embedAndroidProject}/rnApp/root.build.gradle`);
        await this.buildConfig.readAndReplaceFileContent(`${embedAndroidProject}/rnApp/root.build.gradle`, (content) => {
            return content + `\nallprojects {
                configurations.all {
                    resolutionStrategy {
                        force "com.facebook.react:react-native:" + REACT_NATIVE_VERSION
                        force "androidx.annotation:annotation:1.4.0"
                    }
                }
            }`;
        });
        fs.copySync(`${rnAndroidProject}/settings.gradle`, `${embedAndroidProject}/rnApp/root.settings.gradle`);
        await this.buildConfig.readAndReplaceFileContent(`${embedAndroidProject}/rnApp/root.settings.gradle`, (content) => {
            return content.replace('rootProject.name', '//rootProject.name');
        });
        await this.buildConfig.readAndReplaceFileContent(`${embedAndroidProject}/rnApp/root.settings.gradle`, (content) => {
            return content.replace(`':app'`, `':rnApp'`);
        });
        await this.buildConfig.readAndReplaceFileContent(
            `${embedAndroidProject}/gradle.properties`,
            (content) => {
                const nativeProperties = propertiesReader(`${embedAndroidProject}/gradle.properties`);
                const rnProperties = propertiesReader(`${rnAndroidProject}/gradle.properties`);
                content += (Object.keys(rnProperties.getAllProperties())
                .filter(k => (nativeProperties.get(k) === null))
                .map(k => `\n${k}=${rnProperties.get(k)}`)).join('') || '';
                return content.replace('android.nonTransitiveRClass=true', 'android.nonTransitiveRClass=false');
            });
        await this.buildConfig.readAndReplaceFileContent(
            `${embedAndroidProject}/rnApp/src/main/AndroidManifest.xml`,
            (markup) => markup.replace(
                /<intent-filter>(.|\n)*?android:name="android.intent.category.LAUNCHER"(.|\n)*?<\/intent-filter>/g,
            '<!-- Removed React Native Main activity as launcher. Check the embedApp with Launcher activity -->')
            .replace(' android:theme="@style/AppTheme"', '')
            .replace('android:name=".MainApplication"', ''));
        await this.buildConfig.readAndReplaceFileContent(
            `${embedAndroidProject}/rnApp/build.gradle`,
            (content) => {
                return content.replace(
                    `apply plugin: "com.android.application"`,
                    `apply plugin: "com.android.library"`)
                    .replace(/\s*applicationId.*/, '')
                    .replace(`"/scripts/compose-source-maps.js",`,
                        `"/scripts/compose-source-maps.js",\n\tenableVmCleanup: false`)
                    .replace('applicationVariants.all { variant', '/*applicationVariants.all { variant')
                    .replace('implementation "com.facebook.react:react-native:+"', 'api "com.facebook.react:react-native:+"')
                    .replace(
                        /(versionCodes.get\(abi\)\s\*\s1048576\s\+\sdefaultConfig\.versionCode[\s|\n]*\}[\s|\n]*\}[\s|\n]*\})/,
                        '$1*/'
                    );
            });
    
        fs.copySync(
            `${__dirname}/../templates/embed/android/SplashScreenReactActivityLifecycleListener.kt`,
            `${this.buildConfig.config.src}/node_modules/expo-splash-screen/android/src/main/java/expo/modules/splashscreen/SplashScreenReactActivityLifecycleListener.kt`);
        await this.buildConfig.readAndReplaceFileContent(
            `${this.buildConfig.config.dest}/app.js`,
            (content) => content.replace('props = props || {};', 'props = props || {};\n\tprops.landingPage = props.landingPage || props.pageName;'));    
        fs.mkdirpSync(`${this.buildConfig.config.src}/android-embed/rnApp/src/main/assets`);
        await this.buildConfig.readAndReplaceFileContent(
            `${this.buildConfig.config.dest}/node_modules/@wavemaker/app-rn-runtime/components/dialogs/dialogcontent/dialogcontent.component.js`,
            (content) => content.replace('height', 'maxHeight'));    
        await exec('npx', ['react-native', 'bundle', '--platform',  'android',
                '--dev', 'false', '--entry-file', 'index.js',
                '--bundle-output', 'android-embed/rnApp/src/main/assets/index.android.bundle',
                '--assets-dest', 'android-embed/rnApp/src/main/res/'], {
            cwd: this.buildConfig.config.src
        });
        logger.info({
            label: 'android-embed',
            message: 'Changed React Native project.'
        });
    }
}