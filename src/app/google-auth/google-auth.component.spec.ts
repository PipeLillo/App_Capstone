import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { GoogleAuthComponent } from './google-auth.component';

describe('GoogleAuthComponent', () => {
  let component: GoogleAuthComponent;
  let fixture: ComponentFixture<GoogleAuthComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      // ❗️ CORRECCIÓN: Se elimina GoogleAuthComponent de 'declarations'
      declarations: [], 
      // ❗️ Se mantiene en 'imports' por ser Standalone
      imports: [GoogleAuthComponent, IonicModule.forRoot()] 
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
