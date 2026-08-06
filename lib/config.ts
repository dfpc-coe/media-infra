export interface Config {
    silent: boolean
    API_URL: string;
    SigningSecret: string
    CLOUDTAK_Config_media_url: string;
    CLOUDTAK_Config_media_ingest_internal_host: string;
}

export const config: Config = {
    silent: false,
    API_URL: String(process.env.API_URL),
    CLOUDTAK_Config_media_url: String(process.env.CLOUDTAK_Config_media_url),
    CLOUDTAK_Config_media_ingest_internal_host: String(process.env.CLOUDTAK_Config_media_ingest_internal_host || ''),
    SigningSecret: String(process.env.SigningSecret)
};

