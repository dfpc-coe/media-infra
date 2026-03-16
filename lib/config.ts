export interface Config {
    silent: boolean
    API_URL: string;
    SigningSecret: string
    CLOUDTAK_Config_media_url: string;
    MediaAuthCacheTTL: number;
}

export const config: Config = {
    silent: false,
    API_URL: String(process.env.API_URL),
    CLOUDTAK_Config_media_url: String(process.env.CLOUDTAK_Config_media_url),
    SigningSecret: String(process.env.SigningSecret),
    MediaAuthCacheTTL: Number(process.env.MEDIA_AUTH_CACHE_TTL || 30)
};

