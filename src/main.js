import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';
import { vTooltip } from './composables/useTooltip';

createApp(App)
  .use(router)
  .directive('tooltip', vTooltip)
  .mount('#app');
