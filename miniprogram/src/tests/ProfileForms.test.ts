import { measurementProfilePayload, validateMeasurementProfile } from '../presentation/profile/MeasurementProfileForm';
import { reportManagementRows } from '../presentation/report/ReportView';

describe('Profile form and record management projections',()=>{
  it('rejects non-finite age and height before constructing an update request',()=>{
    expect(validateMeasurementProfile({ Gender:'F', Age:'NaN', Height:'165' })).toBe('请确认年龄');
    expect(validateMeasurementProfile({ Gender:'M', Age:'30', Height:'abc' })).toBe('请确认身高');
    expect(validateMeasurementProfile({ Gender:'', Age:30, Height:165 })).toBe('请选择性别');
  });
  it('retains the original profile API field names and account identity',()=>{
    const profile={uid:'A',telHP:'13800001234',name:'A',gender:'F' as const,age:30,height:165};
    expect(measurementProfilePayload(profile,{Gender:'F',Age:'31',Height:'166'},new Date(2026,9,27)))
      .toMatchObject({Type:'MODIFY',UID:'A',TelHP:'13800001234',UserID:'1234',BirthDay:'1995-10-27',Age:31,Height:'166',CountryCode:'86'});
  });
  it('omits deleted records and does not display invalid weight as NaN',()=>{
    const rows=reportManagementRows([{DATETIMES:'20261027120000',WT:'63.7'},
      {DATETIMES:'20261026120000',WT:'bad'}, {DATETIMES:'20261025120000',WT:60,IsDeleted:true}]);
    expect(rows).toHaveLength(2);expect(rows[0].WT).toBe('63.7');expect(rows[1].WT).toBe('');
  });
});
