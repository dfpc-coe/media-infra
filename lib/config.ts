export interface Config {
    silent: boolean
    SigningSecret: string
    CLOUDTAK_Config_media_url: string;
}

export const config: Config = {
    silent: false,
    CLOUDTAK_Config_media_url: String(process.env.CLOUDTAK_Config_media_url),
    SigningSecret: String(process.env.SigningSecret)
};

