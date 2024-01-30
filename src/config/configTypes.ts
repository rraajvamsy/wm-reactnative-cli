export interface ProjectConfiguration{
    projectName: string;
    projectId: string;
    latestVersion: boolean;
    platformVersion: string;
    authCookie: string;
    baseUrl: string;
    projectDir: string;
    wmProjectDir: string;
    expoProjectDir: string;
    syncProject: Function;
}

export interface PreviewConfiguration{
    proxyUrl: string;
    expoUrl: string;
    proxyPort: number;
    previewUrl: string;
    clean: boolean;
    isWebExpo: boolean;
    isEsBuild: boolean;
    nativeType: string
}

export interface BuildAndroidConfiguration{
    src: string;
    dest: string;
    platform: string;
    aKeyStore: string;
    aStorePassword: string;
    aKeyAlias: string;
    aKeyPassword: string;
    metaData: any;
    buildType: string;
    modulePath?: string;
    localrnruntimepath?: string;
}

export interface BuildAndroidDebugConfiguration{
    src: string;
    platform: string;
    metaData: any;
    buildType: string;
    modulePath?: string;
    localrnruntimepath?: string;
}

export interface BuildIOSConfiguration{
    src: string;
    iCertificate: string;
    platform: string;
    packageType: string;
    iCertificatePassword: string;
    iProvisioningFile: string;
    metaData: any;
    iCodeSigningIdentity: string;
    buildType: string;
    modulePath?: string;
    localrnruntimepath?: string;
}

export interface Versions{
    'NODE': string;
    'POD' : string;
    'JAVA': string;
    'REACT_NATIVE': string;
    'EXPO': string;
}
