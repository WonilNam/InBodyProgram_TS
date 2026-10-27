// ─── 业务层错误码 ───
export enum InBodyErrorCode {
    NONE = 0,
    TIMEOUT = -1,
    TRYAGAIN = -2,
    NODEVICE = -3,
    MULTIDEVICE = -4,
    READY = -5,
    CANCEL = -6,
    COMPLETE = -7,
    NODEVICETIMEOUT = -8,
    DATAERROR = -9,
    ABNORMALERROR = -10,
    ABNORMALDISCONNECT = -11,
    NODEVICEOTA = -12,
    UNSUPPORTED = -13,          // 当前型号不支持此操作
}

export class InBodyError extends Error {
    constructor(public code: InBodyErrorCode, message: string) {
        super(message);
        this.name = 'InBodyError';
        Object.setPrototypeOf(this, InBodyError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message
        };
    }
}
