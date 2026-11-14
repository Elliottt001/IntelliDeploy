import {defineConfig} from '@playwright/test';
import component from './playwright.component.config';
export default defineConfig({...component,testDir:'./e2e',testMatch:'mobile-complete-motion.spec.ts'});
