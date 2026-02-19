import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'https://konitys-keycloak-prod.up.railway.app',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'konitys',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'stock-management-client',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
