import { Request } from 'express';
import Err from '@openaddresses/batch-error';
import jwt from 'jsonwebtoken';
import type { Config } from './config.js';

export type AuthResourceAccepted = {
    access: AuthResourceAccess;
    id?: string | number | undefined;
}

export enum AuthResourceAccess {
    MEDIA = 'media',
    LEASE = 'lease',
}

export function managementToken(token: string): string {
    return jwt.sign(
        {
            access: AuthResourceAccess.MEDIA,
            internal: true
        },
        token,
        {
            // 120 Seconds
            expiresIn: 120
        }
    )
}

function castResourceAccessEnum(str: string): AuthResourceAccess | undefined {
  const value = AuthResourceAccess[str.toUpperCase() as keyof typeof AuthResourceAccess];
  return value;
}

export class AuthResource {
    id: number | string | undefined;
    access: AuthResourceAccess;
    token: string;
    internal: boolean;

    constructor(
        token: string,
        access: AuthResourceAccess,
        id: number | string | undefined,
        internal: boolean
    ) {
        this.token = token;
        this.internal = internal;
        this.access = access;
        this.id = id;
    }
}

export default class Auth {
    static async is_auth(
        config: Config,
        req: Request<any, any, any, any>,
        opts: {
            token?: boolean;
            anyResources?: boolean;
            resources?: Array<AuthResourceAccepted>;
        } = {}
    ): Promise<AuthResource> {
        if (!opts.token) opts.token = false;
        if (!opts.resources) opts.resources = [];
        if (!opts.anyResources) opts.anyResources = false;

        const auth = await auth_request(config, req, { token: opts.token });

        if (!auth || !auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        if (opts.anyResources && opts.resources.length) {
            throw new Err(403, null, 'Server cannot specify defined resource access and any resource access together');
        } else if (!opts.anyResources && !opts.resources.length) {
            throw new Err(403, null, 'Resource token cannot access resource');
        }

        if (!auth.internal) {
            throw new Err(403, null, 'Only Internal Tokens can access MediaServer');
        }

        if (!opts.anyResources && !opts.resources.some((r) => {
            if (r.id) {
                return r.access === auth.access && r.id === auth.id;
            } else {
                return r.access === auth.access;
            }
        })) {
            throw new Err(403, null, 'Resource token cannot access this resource');
        }

        return auth;
    }
}

async function auth_request(
    config: Config,
    req: Request<any, any, any, any>,
    opts?: {
        token: boolean
    }
): Promise<AuthResource> {
    try {
        if (req.headers && req.header('authorization')) {
            const authorization = (req.header('authorization') || '').split(' ');

            if (authorization[0].toLowerCase() !== 'bearer') {
                throw new Err(401, null, 'Only "Bearer" authorization header is allowed')
            }

            if (!authorization[1]) {
                throw new Err(401, null, 'No bearer token present');
            }

            return await tokenParser(config, authorization[1], config.SigningSecret);
        } else if (
            opts
            && opts.token
            && req.query
            && req.query.token
            && typeof req.query.token === 'string'
        ) {
            return await tokenParser(config, req.query.token, config.SigningSecret);
        } else {
            throw new Err(401, null, 'No Auth Present')
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'PublicError') {
            throw err;
        } else {
            throw new Err(401, new Error(String(err)), 'Invalid Token')
        }
    }
}

export async function tokenParser(
    config: Config,
    token: string,
    secret: string
): Promise<AuthResource> {
    token = token.replace(/^etl\./, '');

    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') throw new Err(400, null, 'Decoded JWT Should be Object');
    if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');
    if (!decoded.internal || typeof decoded.internal !== 'boolean') decoded.internal = false;
    if (!decoded.internal && !decoded.id) throw new Err(401, null, 'Invalid Token');

    const access = castResourceAccessEnum(decoded.access);
    if (!access) throw new Err(400, null, 'Invalid Resource Access Value');

    return new AuthResource(`etl.${token}`, access, decoded.id, decoded.internal);
}