import { BoundEquipment, UserProfile } from '../../domain/entities/UserProfile.entity';
import { ObservableStore } from './ObservableStore';

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly isGuest: boolean;
  readonly profile: UserProfile | null;
  readonly boundEquipment: BoundEquipment | null;
}

const INITIAL_AUTH_STATE: AuthState = {
  isAuthenticated: false,
  isGuest: true,
  profile: null,
  boundEquipment: null,
};

export class AuthStore extends ObservableStore<AuthState> {
  private sessionVersion = 0;

  getSessionVersion(): number {
    return this.sessionVersion;
  }
  constructor() {
    super(INITIAL_AUTH_STATE);
  }

  setAuthenticatedUser(profile: UserProfile, boundEquipment: BoundEquipment | null = null): void {
    const previous = this.getState().profile;
    if (previous?.uid !== profile.uid || previous?.telHP !== profile.telHP) {
      this.sessionVersion++;
    }
    this.setState({
      isAuthenticated: Boolean(profile.uid && profile.telHP),
      isGuest: !profile.uid || !profile.telHP,
      profile,
      boundEquipment,
    });
  }

  setBoundEquipment(boundEquipment: BoundEquipment | null): void {
    this.setState({ boundEquipment });
  }

  enterGuestMode(): void {
    this.sessionVersion++;
    this.setState({
      isAuthenticated: false,
      isGuest: true,
      profile: null,
      boundEquipment: null,
    });
  }
}
