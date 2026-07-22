// Development environment — used by `ng serve`. Points at the local .NET API.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5119',
  // Google OAuth client id (public value — safe to ship in the bundle). Add http://localhost:4200
  // to the client's "Authorized JavaScript origins" in Google Cloud Console.
  googleClientId: '874827586206-quqmqmn2j3mbt71r1inm4s18o4eaqdf0.apps.googleusercontent.com',
};
