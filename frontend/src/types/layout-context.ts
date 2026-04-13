export type AppLayoutOutletContext = {
  sidebarCollapsed: boolean;
  /** Override TopBar title (e.g. Dashboard greeting). Pass null to use route default. */
  setHeaderTitle: (title: string | null) => void;
};
