import { CommonRouteContainerModel } from './common-route-container.model';

describe('CommonRouteContainerModel', () => {
  it('should expose the common prefix', () => {
    expect(CommonRouteContainerModel.prefix).toBe('common');
  });

  it('should build the signin fullPath from the prefix', () => {
    expect(CommonRouteContainerModel.SIGNIN_ROUTE.path).toBe('signin');
    expect(CommonRouteContainerModel.SIGNIN_ROUTE.fullPath).toBe('/common/signin');
  });

  it('should expose the titled signin route to the navbar', () => {
    const navbarRoutes = CommonRouteContainerModel.getNavbarRoutes(CommonRouteContainerModel);

    expect(navbarRoutes.map((route) => route.path)).toEqual(['signin']);
  });
});
