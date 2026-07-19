import '@angular/localize/init';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { locale } from '@ghostfolio/common/config';
import { Meta, Story, moduleMetadata } from '@storybook/angular';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { GfValueModule } from '../value';
import { FireCalculatorComponent } from './fire-calculator.component';
import { FireCalculatorService } from './fire-calculator.service';

export default {
  title: 'FIRE Calculator',
  component: FireCalculatorComponent,
  decorators: [
    moduleMetadata({
      declarations: [FireCalculatorComponent],
      imports: [
        CommonModule,
        FormsModule,
        GfValueModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        NgxSkeletonLoaderModule,
        NoopAnimationsModule,
        ReactiveFormsModule
      ],
      providers: [FireCalculatorService]
    })
  ]
} as Meta<FireCalculatorComponent>;

const Template: Story<FireCalculatorComponent> = (
  args: FireCalculatorComponent
) => ({
  props: args
});

export const Simple = Template.bind({});
Simple.args = {
  currency: 'USD',
  fireWealth: 0,
  locale: locale
};
