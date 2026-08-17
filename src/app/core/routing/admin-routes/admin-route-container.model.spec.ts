import { AdminRouteContainerModel } from './admin-route-container.model';

describe('AdminRouteContainerModel', () => {
  it('should expose the admin prefix', () => {
    expect(AdminRouteContainerModel.prefix).toBe('admin');
  });

  it('should build the home fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.HOME_ROUTE.path).toBe('home');
    expect(AdminRouteContainerModel.HOME_ROUTE.fullPath).toBe('/admin/home');
  });

  it('should declare a catch-all route', () => {
    expect(AdminRouteContainerModel.ANY_OTHER_ADMIN_ROUTE.path).toBe('**');
  });

  it('should expose only titled routes to the navbar', () => {
    const navbarRoutes = AdminRouteContainerModel.getNavbarRoutes(AdminRouteContainerModel);

    expect(navbarRoutes.map((route) => route.path)).toEqual([
      'home',
      'quote-request',
      'mes-devis',
      'mes-extranets',
    ]);
  });

  it('should build the quote-request fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.path).toBe('quote-request');
    expect(AdminRouteContainerModel.QUOTE_REQUEST_ROUTE.fullPath).toBe('/admin/quote-request');
  });

  it('should build the mes-devis fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.QUOTE_FILES_ROUTE.path).toBe('mes-devis');
    expect(AdminRouteContainerModel.QUOTE_FILES_ROUTE.fullPath).toBe('/admin/mes-devis');
  });

  it('should build the mes-extranets fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.EXTRANET_LINKS_ROUTE.path).toBe('mes-extranets');
    expect(AdminRouteContainerModel.EXTRANET_LINKS_ROUTE.fullPath).toBe('/admin/mes-extranets');
  });

  it('should build the mes-extranets/nouveau fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.EXTRANET_LINK_NEW_ROUTE.path).toBe('mes-extranets/nouveau');
  });

  it('should build the mes-extranets/:extranetLinkId fullPath from the prefix', () => {
    expect(AdminRouteContainerModel.EXTRANET_LINK_EDIT_ROUTE.path).toBe('mes-extranets/:extranetLinkId');
  });
});

