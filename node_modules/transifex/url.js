module.exports = function ( projectName ) {
  const BASE_URL = "https://www.transifex.com/api/2/";
  const BASEP_URL = BASE_URL + "project/";
  const projectUrl = BASEP_URL + projectName + "/";
  const prSlug = BASEP_URL + "<project_slug>/resource/<resource_slug>/";
  const plSlug = BASEP_URL + "<project_slug>/language/<language_code>/";

  var API = {
    projectInstanceAPI: BASEP_URL + "<project_slug>/?details",
    projectResources: BASEP_URL + "<project_slug>/resources/",
    projectResource: prSlug + "?details",
    projectResourceFile: prSlug + "content/?file",
    languageSetURL: BASEP_URL + "<project_slug>/languages/",
    languageInstanceURL: plSlug + "?details",
    contributorForURL: plSlug + "<type>/",
    translationMethodURL: prSlug + "translation/<language_code>/?file",
    translationStringsURL: prSlug + "translation/<language_code>/strings?details",
    statsMethodURL: prSlug + "stats/<language_code>/",
    languageURL: BASE_URL + "language/<language_code>/",
    languagesURL: BASE_URL + "languages/",
    txProjects: BASE_URL + "projects/",
    projectDetailsAPIUrl: projectUrl + "?details"
  };

  return {
    API: API
  };
};
