import { Type } from '@sinclair/typebox';

export const Path = Type.Object({
    name: Type.String(),
    record: Type.Boolean(),
    runOnInit: Type.Optional(Type.String()),
    source: Type.Optional(Type.String()),
    sourceOnDemand: Type.Optional(Type.Boolean()),
});

export const CloudTAKRemotePath = Type.Object({
    id: Type.Number(),
    path: Type.String(),
    recording: Type.Boolean(),
    proxy: Type.Union([Type.String(), Type.Null()]),
})

export const CloudTAKRemotePaths = Type.Object({
    total: Type.Integer(),
    items: Type.Array(CloudTAKRemotePath)
});

export const StandardResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String()
});