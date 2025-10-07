# PageSkeleton Component

A reusable skeleton loading component that provides consistent loading states across all pages in the application.

## Usage

```tsx
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { Database } from "lucide-react";

// Basic usage
if (loading) {
  return <PageSkeleton />;
}

// With custom configuration
if (loading) {
  return (
    <PageSkeleton
      title="Custom Page Title"
      icon={Database}
      showCards={true}
      cardCount={3}
      showTable={true}
      tableRows={8}
      showDeviceInfo={true}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Loading..."` | Title to show in skeleton (currently shows as skeleton) |
| `icon` | `React.ComponentType` | `undefined` | Icon component to display in header |
| `showCards` | `boolean` | `true` | Whether to show card skeletons |
| `cardCount` | `number` | `2` | Number of cards to display |
| `showTable` | `boolean` | `false` | Whether to show table skeleton |
| `tableRows` | `number` | `5` | Number of table rows to display |
| `showDeviceInfo` | `boolean` | `false` | Whether to show device info card skeleton |

## Page-Specific Examples

### System Health Page
```tsx
<PageSkeleton
  icon={Activity}
  showCards={true}
  cardCount={2}
  showTable={false}
  showDeviceInfo={false}
/>
```

### Modbus Data Page
```tsx
<PageSkeleton
  icon={Database}
  showDeviceInfo={true}
  showTable={true}
  tableRows={10}
  showCards={false}
/>
```

### User Management Page
```tsx
<PageSkeleton
  icon={Users}
  showCards={false}
  showTable={true}
  tableRows={6}
  showDeviceInfo={false}
/>
```

### Dashboard Pages
```tsx
<PageSkeleton
  icon={LayoutDashboard}
  showCards={true}
  cardCount={4}
  showTable={false}
  showDeviceInfo={false}
/>
```

## Features

- **Consistent Layout**: Uses SidebarInset, SidebarTrigger, and header structure
- **Responsive Design**: Adapts to different screen sizes
- **Customizable**: Multiple props to match different page layouts
- **Accessible**: Proper semantic structure for screen readers
- **Smooth Animation**: Uses the existing Skeleton component with pulse animation

## Implementation Steps

1. Import the PageSkeleton component
2. Replace your existing loading UI with PageSkeleton
3. Configure props based on your page layout
4. Test the loading state to ensure proper appearance

## Notes

- The component automatically handles the standard page layout structure
- All skeletons use the existing `Skeleton` component from `@/components/ui/skeleton`
- The component is fully responsive and works across all device sizes
- Colors and animations inherit from your existing theme configuration