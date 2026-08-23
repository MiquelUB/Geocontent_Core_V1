'use server'


import * as queryService from '../services/queries';

export async function getAppBranding() { return queryService.getAppBranding(); }
export async function getMunicipalities() { return queryService.getMunicipalities(); }
export async function getAdminLegends() { return queryService.getAdminLegends(); }
export async function getRouteWithPois(routeId: string) { return queryService.getRouteWithPois(routeId); }
export async function getAllProfiles() { return queryService.getAllProfiles(); }
export async function getLegends(userId?: string) { return queryService.getLegends(userId); }
export async function getDefaultMunicipalityId() { return queryService.getDefaultMunicipalityId(); }
export async function getDefaultMunicipalityTheme() { return queryService.getDefaultMunicipalityTheme(); }
export async function getUserScore(userId: string) { return queryService.getUserScore(userId); }
export async function getPassportData(userId: string) { return queryService.getPassportData(userId); }
