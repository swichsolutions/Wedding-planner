// The live site: weddingplanner.ge on Cloudflare Workers, API at api.weddingplanner.ge (Render).
// Swapped in for environment.ts by the `live` build configuration (fileReplacements in
// angular.json). Both values ship in the browser bundle anyway, so they can live in git.
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.weddingplanner.ge',
  // Google OAuth client id (public). The button only works once https://weddingplanner.ge is in
  // the client's "Authorized JavaScript origins" in Google Cloud Console; set '' to hide it.
  googleClientId: '874827586206-quqmqmn2j3mbt71r1inm4s18o4eaqdf0.apps.googleusercontent.com',
};
