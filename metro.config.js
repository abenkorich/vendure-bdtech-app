const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.json` is already handled; graphql documents are authored in TS via gql.tada,
// so no extra Metro transformer is needed.
module.exports = config;
