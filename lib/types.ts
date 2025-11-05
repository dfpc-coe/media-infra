import { Type } from '@sinclair/typebox'

export const StandardResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String()
});
