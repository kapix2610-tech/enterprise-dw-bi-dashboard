const { serverlessHandler } = require("../dw-bi-backend/server");

module.exports = (req, res) => {
  const requestUrl = new URL(req.url, "http://localhost");
  const route = requestUrl.searchParams.get("path");
  if (route) {
    requestUrl.searchParams.delete("path");
    const apiPath = route.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    req.url = `/api/${apiPath}${requestUrl.search}`;
  }
  return serverlessHandler(req, res);
};