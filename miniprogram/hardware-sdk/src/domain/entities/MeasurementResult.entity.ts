/**
 * 测量结果实体 (Measurement Result Entities)
 * 设备完成测量后返回的最终体成分数据。
 * 注意：这是纯粹的业务实体，不继承通信层的 BaseDeviceResponse。
 */

/** 跨设备通用的核心测量指标 */
export interface BaseMeasurementResult {
    /** 产出此结果的设备标识 */
    deviceId: string;
    /** 标记为已完成的测量数据 */
    isCompleted: true;
    /** 协议指令标识 (如 'HR')，用于在 InBodyResult 联合类型中做判别。虽然测量结果是独立业务实体，但管道需要此字段进行路由。 */
    cmd: string;
    /** 测量时间，格式由设备协议决定 */
    dateTime?: string; 
    /** 性别：1=M，0=F */
    sex?: number;            
    /** 年龄 */
    age?: number;
    /** 身高 (cm) */
    height?: number;         
    /** 体重 (kg) */
    weight?: number;         
    /** 体脂率 (%) */
    pbf?: number;
    /** 肌肉量 (kg) */
    slm?: number;
    /** BMI */
    bmi?: number;            
    /** 内脏脂肪等级 */
    vfaLevel?: number;
}

/** InBody 120 独占数据结构 */
export interface InBody120MeasurementResult extends BaseMeasurementResult {
    tbw?: number;            // 身体总水分 (kg)
    mineral?: number;        // 无机盐 (kg)
    protein?: number;        // 蛋白质 (kg)
    whr?: number;            // 腰臀比
    bmc?: number;            // 骨矿量 (kg)
    smm?: number;            // 骨骼肌量 (kg), PDF No.12 SMM
    bfm?: number;            // 体脂肪量 (kg)
    fitScore?: number;       // InBody 评分, PDF No.65
    bmr?: number;            // 基础代谢率 (kcal)
    bfmp?: number;           // 体脂肪量百分比 (%), PDF No.22
    smmp?: number;           // 骨骼肌量百分比 (%), PDF No.23
    pbfp?: number;           // 体脂率百分比 (%), PDF No.24
    weightp?: number;        // 体重百分比 (%), PDF No.25
    proteinMax?: number; proteinMin?: number;      // 蛋白质正常范围 (kg)
    mineralMax?: number; mineralMin?: number;      // 无机盐正常范围 (kg)
    bfmMax?: number; bfmMin?: number;              // 体脂肪量正常范围 (kg)
    wtMax?: number; wtMin?: number;                // 体重正常范围 (kg)
    pbfMax?: number; pbfMin?: number;              // 体脂率正常范围 (%)
    whrMax?: number; whrMin?: number;              // 腰臀比正常范围
    vflMin?: number; vflMax?: number;              // 内脏脂肪等级正常范围
    tbwMax?: number; tbwMin?: number;              // 身体总水分正常范围 (kg)
    iWeight?: number;                              // 理想体重 (kg), PDF No.61
    wc?: number; mc?: number; fc?: number;         // 体重/肌肉/脂肪控制量 (kg)
    smmMax?: number; smmMin?: number;              // 骨骼肌量正常范围 (kg)
    bmrMin?: number; bmrMax?: number;              // 基础代谢率正常范围 (kcal)
    
    ffmpRa?: number; ffmpLa?: number; ffmpT?: number; ffmpRl?: number; ffmpLl?: number; // 右/左上肢、全身、右/左下肢骨骼肌百分比 (%)
    ira20?: number; ila20?: number; it20?: number; irl20?: number; ill20?: number;      // 20kHz 阻抗: 右上肢/左上肢/躯干/右下肢/左下肢
    ira100?: number; ila100?: number; it100?: number; irl100?: number; ill100?: number; // 100kHz 阻抗: 右上肢/左上肢/躯干/右下肢/左下肢
    pfra?: number; pfla?: number; pft?: number; pfrl?: number; pfll?: number;           // 右/左上肢、全身、右/左下肢体脂肪百分比 (%)
    obesity?: number; odMax?: number; odMin?: number;                                  // 肥胖度及正常范围 (%)
    lra?: number; lla?: number; lt?: number; lrl?: number; lll?: number;               // 右/左上肢、躯干、右/左下肢肌肉量 (kg)
    fra?: number; fla?: number; ft?: number; frl?: number; fll?: number;               // 右/左上肢、躯干、右/左下肢脂肪量 (kg)
}

/** InBody H20 独占数据结构 */
export interface InBodyH20MeasurementResult extends BaseMeasurementResult {
    inllLv?: number;         // 下肢肌肉等级
    
    ira20?: number; ila20?: number; it20?: number; irl20?: number; ill20?: number;      // 20kHz 阻抗: 右上肢/左上肢/躯干/右下肢/左下肢
    ira100?: number; ila100?: number; it100?: number; irl100?: number; ill100?: number; // 100kHz 阻抗: 右上肢/左上肢/躯干/右下肢/左下肢
}

/** InBody H30/H40 复合数据结构 (最全量) */
export interface InBodyH30MeasurementResult extends BaseMeasurementResult {
    tbw?: number;            // 身体总水分 (kg)
    mineral?: number;        // 矿物质 (kg)
    protein?: number;        // 蛋白质 (kg)
    whr?: number;            // 腰臀比
    bmc?: number;            // 骨矿量 (kg)
    smm?: number;            // 骨骼肌量
    slm?: number;            // 肌肉量
    bfm?: number;            // 体脂肪量 (kg)
    fitScore?: number;       // InBody 评分
    bmr?: number;            // 基础代谢率 (kcal)
    
    iWeight?: number;        // 理想体重 (kg)
    iSMM?: number;           // 理想骨骼肌量
    iBFM?: number;           // 理想体脂肪量
    pwt?: number;            // 体重率
    
    balUps?: number;         // 上体平衡状态
    balLows?: number;        // 下体平衡状态
    balUls?: number;         // 上下体平衡状态
    
    
    tbwMax?: number; tbwMin?: number;              // 身体总水分正常范围 (kg)
    slmMax?: number; slmMin?: number;              // 肌肉量正常范围 (kg)
    odk?: number;                                  // 儿童肥胖度
    obesity?: number;                              // 肥胖度 (%)
    odMax?: number; odMin?: number;                // 肥胖度正常范围 (%)
    tw?: number;                                   // 目标体重 (kg)
    wc?: number;                                   // 体重控制量 (kg)
    mc?: number;                                   // 肌肉控制量 (kg)
    fc?: number;                                   // 脂肪控制量 (kg)
    bmcMax?: number; bmcMin?: number;              // 骨矿量正常范围 (kg)
    proteinMax?: number; proteinMin?: number;      // 蛋白质正常范围 (kg)
    mineralMax?: number; mineralMin?: number;      // 矿物质正常范围 (kg)
    
    psmm?: number;           // 骨骼肌量图表百分比
    pfatNew?: number;        // 体脂肪量百分比图表值
    ibmi?: number;           // 理想 BMI
    bmiMax?: number; bmiMin?: number;              // BMI 正常范围
    ipbf?: number;           // 理想体脂率 (%)
    pbfMax?: number; pbfMin?: number;              // 体脂率正常范围 (%)
    iwhr?: number;           // 理想腰臀比
    whrMax?: number; whrMin?: number;              // 腰臀比正常范围
    islm?: number;           // 理想肌肉量
    iprotein?: number;       // 理想蛋白质 (kg)
    imineral?: number;       // 理想矿物质 (kg)
    ibmc?: number;           // 理想骨矿量 (kg)
    inllLv?: number;         // 下肢肌肉等级
}

/** 所有型号测量结果的联合类型 */
export type InBodyMeasurementResult = InBody120MeasurementResult | InBodyH20MeasurementResult | InBodyH30MeasurementResult;
