// Production environment (default). Swapped to environment.development.ts for `ng serve`
// via fileReplacements in angular.json. Set apiBaseUrl to the real API origin at deploy.
export const environment = {
  production: true,
  apiBaseUrl: '',
  // Google OAuth client id (public). Set this to the production OAuth client at deploy, and add
  // the production origin to its "Authorized JavaScript origins" in Google Cloud Console.
  googleClientId: '874827586206-quqmqmn2j3mbt71r1inm4s18o4eaqdf0.apps.googleusercontent.com',
};
