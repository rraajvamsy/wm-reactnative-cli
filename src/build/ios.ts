import { BuildConfig } from "../config/buildConfig";
import { IOSUtils } from "./iosUtils";
const fs = require('fs-extra');
const logger = require('../utils/logger');
import { exec } from '../utils/exec';

export class IOS{
    buildConfig: BuildConfig;
    iosUtils: IOSUtils;
    constructor(config: BuildConfig){
        this.buildConfig = config;
        this.iosUtils = new IOSUtils(this.buildConfig);
    }

    updateJSEnginePreference() {
        const jsEngine = require(this.buildConfig.config.src + 'app.json').expo.jsEngine;
        const podJSON = this.buildConfig.config.src + 'ios/Podfile.properties.json';
        if (fs.existsSync(podJSON)) {
            let data = require(podJSON);
            data['expo.jsEngine'] = jsEngine;
            fs.writeFileSync(podJSON, JSON.stringify(data, null, 4));
            logger.info({
                label: 'update-jsEngine-preference',
                message: `js engine is set as ${jsEngine}`
            });
        }
    }
    

    async invokeiosBuild() {
        const certificate = this.buildConfig.config.iCertificate;
        const certificatePassword = this.buildConfig.config.iCertificatePassword;
        const provisionalFile = this.buildConfig.config.iProvisioningFile;
        const buildType = this.buildConfig.config.buildType;
        this.updateJSEnginePreference();
        const random = Date.now();
        const username = await this.iosUtils.getUsername();
        const keychainName = `wm-reactnative-${random}.keychain`;
        const provisionuuid =  await this.iosUtils.extractUUID();
        let codeSignIdentity = await exec(`openssl pkcs12 -in ${certificate} -passin pass:${certificatePassword} -nodes | openssl x509 -noout -subject -nameopt multiline | grep commonName | sed -n 's/ *commonName *= //p'`, null, {
            shell: true
        }) as any;
        codeSignIdentity = codeSignIdentity[1];
        let useModernBuildSystem = 'YES';
        logger.info({
            label: 'ios-build',
            message: `provisional UUID : ${provisionuuid}`
        });
        const developmentTeamId = await this.iosUtils.extractTeamId();
        logger.info({
            label: 'ios-build',
            message: `developmentTeamId : ${developmentTeamId}`
        });
        const ppFolder = `/Users/${username}/Library/MobileDevice/Provisioning\ Profiles`;
        fs.mkdirSync(ppFolder, {
            recursive: true
        })
        const targetProvisionsalPath = `${ppFolder}/${provisionuuid}.mobileprovision`;
        fs.copyFileSync(provisionalFile, targetProvisionsalPath);
        logger.info({
            label: 'ios-build',
            message: `copied provisionalFile (${provisionalFile}).`
        });
        const removeKeyChain = await this.iosUtils.importCertToKeyChain(keychainName, certificate, certificatePassword);

        try {
            // XCode14 issue https://github.com/expo/expo/issues/19759
            // This is not required when expo 47 is used.
            await this.buildConfig.readAndReplaceFileContent(`${this.buildConfig.config.src}ios/Podfile`, (content) => {
                return content.replace('__apply_Xcode_12_5_M1_post_install_workaround(installer)', 
                '__apply_Xcode_12_5_M1_post_install_workaround(installer)' + '\n' +
                '    # Add these lines for Xcode 14 builds' + '\n' +
                '    installer.pods_project.targets.each do |target| ' +   '\n' +
                '       if target.respond_to?(:product_type) and target.product_type == "com.apple.product-type.bundle"' + '\n' +
                '           target.build_configurations.each do |config|'+ '\n' +
                '               config.build_settings[\'CODE_SIGNING_ALLOWED\'] = \'NO\'' + '\n' +
                '           end' + '\n' +
                '       end' + '\n' +
                '   end')
            });
            await exec('pod', ['install'], {cwd: this.buildConfig.config.src + 'ios'});
            return await this.xcodebuild(codeSignIdentity, provisionuuid, developmentTeamId);
        } catch (e) {
            console.error(e);
            return {
                errors: e,
                success: false
            }
        } finally {
            await removeKeyChain();
        }
    }

    async xcodebuild(CODE_SIGN_IDENTITY_VAL, PROVISIONING_UUID, DEVELOPMENT_TEAM) {
        try {
            let xcworkspacePath = this.buildConfig.buildUtils.findFile(this.buildConfig.config.src + 'ios', /\.xcworkspace?/) || this.buildConfig.buildUtils.findFile(this.buildConfig.config.src + 'ios', /\.xcodeproj?/);
            if (!xcworkspacePath) {
                return {
                    errors: '.xcworkspace or .xcodeproj files are not found in ios directory',
                    success: false
                }
            }
            const projectName = fs.readdirSync(`${this.buildConfig.config.src}ios`)
                .find(f => f.endsWith('xcodeproj'))
                .split('.')[0];
            const pathArr = xcworkspacePath.split('/');
            const xcworkspaceFileName = pathArr[pathArr.length - 1];
            const fileName = xcworkspaceFileName.split('.')[0];
            this.iosUtils.removePushNotifications(this.buildConfig.config.src, fileName);
            let _buildType;
            if (this.buildConfig.config.buildType === 'development' || this.buildConfig.config.buildType === 'debug') {
                _buildType = 'Debug';
                // Instead of loading from metro server, load it from the bundle.
                await this.buildConfig.readAndReplaceFileContent(`${this.buildConfig.config.src}ios/${projectName}.xcodeproj/project.pbxproj`, (content) => {
                    return content.replace('SKIP_BUNDLING=1', 'FORCE_BUNDLING=1')
                });
                await this.buildConfig.readAndReplaceFileContent(`${this.buildConfig.config.src}ios/${projectName}/AppDelegate.mm`, (content) => {
                    return content.replace(
                        'return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];',
                        'return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];')
                });
            } else {
                _buildType = 'Release';
            }
            const env = {
                RCT_NO_LAUNCH_PACKAGER: 1
            };
            await exec('xcodebuild', [
                '-workspace', fileName + '.xcworkspace',
                '-scheme', fileName,
                '-configuration', _buildType,
                '-destination', 'generic/platform=iOS',
                '-archivePath', 'build/' + fileName + '.xcarchive', 
                'CODE_SIGN_IDENTITY=' + CODE_SIGN_IDENTITY_VAL,
                'PROVISIONING_PROFILE=' + PROVISIONING_UUID,
                'CODE_SIGN_STYLE=Manual',
                'archive'], {
                cwd: this.buildConfig.config.src + 'ios',
                env: env
            });
    
            const status = await this.iosUtils.updateInfoPlist(fileName, PROVISIONING_UUID);
            if (status === 'success') {
                await exec('xcodebuild', [
                    '-exportArchive',
                    '-archivePath', 'build/' + fileName + '.xcarchive',
                    '-exportOptionsPlist', 'build/' + fileName + '.xcarchive/Info.plist', 
                    '-exportPath',
                    'build'], {
                    cwd: this.buildConfig.config.src + 'ios',
                    env: env
                });
                const output =  this.buildConfig.config.dest + 'output/ios/';
                const outputFilePath = `${output}${fileName}(${this.buildConfig.config.metaData.version}).${this.buildConfig.config.buildType}.ipa`;
                fs.mkdirSync(output, {recursive: true});
                fs.copyFileSync(this.buildConfig.buildUtils.findFile(`${this.buildConfig.config.dest}ios/build/`, /\.ipa?/), outputFilePath);
                return {
                    success: true,
                    output: outputFilePath
                }
            }
        } catch (e) {
            logger.error({
                label: 'xcode-build',
                message: e
            });
            console.error(e);
            return {
                errors: e,
                success: false
            }
        }
    }

}