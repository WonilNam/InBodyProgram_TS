import { UserProfile } from '../../domain/entities/UserProfile.entity';

export interface MeasurementProfileInput { Gender: string; Height: string | number; Age: string | number }
export function validateMeasurementProfile(input: MeasurementProfileInput): string | null {
  if (input.Gender !== 'M' && input.Gender !== 'F') return '请选择性别';
  const height = Number(input.Height), age = Number(input.Age);
  if (!Number.isFinite(height) || height < 50 || height > 300) return '请确认身高';
  if (!Number.isFinite(age) || age < 1 || age > 99) return '请确认年龄';
  return null;
}
export function measurementProfilePayload(profile: UserProfile, input: MeasurementProfileInput, today = new Date()): Record<string, unknown> {
  const error = validateMeasurementProfile(input);
  if (error) throw new Error(error);
  const alias = profile.telHP.slice(-4);
  const age = Number(input.Age);
  return { Type: 'MODIFY', UID: profile.uid, UserID: alias, TelHP: profile.telHP,
    LoginPW: 'temppw', Name: alias, UserNickName: alias,
    BirthDay: `${today.getFullYear() - age}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getDate()}`,
    Age: age, Gender: input.Gender, Height: input.Height, Weight: '', CountryCode: '86' };
}
export function measurementProfileFields(profile: UserProfile) {
  return { Height: profile.height || '', Gender: profile.gender, Age: profile.age || '',
    Gender_M: profile.gender === 'M', Gender_F: profile.gender === 'F' };
}
