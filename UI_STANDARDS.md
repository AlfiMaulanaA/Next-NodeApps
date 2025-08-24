# UI Standards Documentation

## Standard Layout Structure

Semua halaman menggunakan struktur layout yang konsisten dengan komponen UI standar Shadcn/UI dan pola SidebarInset.

### Layout Pattern

```tsx
<SidebarInset>
  {/* Header */}
  <header className="flex h-16 items-center justify-between border-b px-4">
    <div className="flex items-center gap-2">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <IconComponent className="h-5 w-5" />
      <h1 className="text-lg font-semibold">Page Title</h1>
    </div>
    <div className="flex items-center gap-2">
      <MqttStatus />
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={refresh}>
        <RotateCw className="h-4 w-4" />
      </Button>
      <Button size="sm" onClick={openModal}>
        <PlusCircle className="h-4 w-4 mr-2" />
        Add New
      </Button>
    </div>
  </header>
  
  {/* Search (Optional) */}
  <div className="px-4 py-2 border-b">
    <div className="relative max-w-sm">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-8"
      />
    </div>
  </div>
  
  {/* Content Area */}
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {/* Summary Cards */}
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconComponent className="h-5 w-5" />
          <CardTitle>Summary Title</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Summary Items */}
        </div>
      </CardContent>
    </Card>
    
    {/* Data Table */}
    <Card>
      <CardHeader>
        <CardTitle>Data Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          {/* Table Content */}
        </Table>
      </CardContent>
    </Card>
    
    {/* Pagination */}
    {totalPages > 1 && (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing results info
        </p>
        <Pagination>
          {/* Pagination Content */}
        </Pagination>
      </div>
    )}
  </div>
  
  {/* Modals/Dialogs */}
  <Dialog open={modalOpen} onOpenChange={setModalOpen}>
    {/* Dialog Content */}
  </Dialog>
</SidebarInset>
```

## Component Standards

### 1. Header Standards
- **Height**: Fixed `h-16`
- **Padding**: `px-4`
- **Border**: `border-b`
- **Left Section**: SidebarTrigger + Separator + Icon + Title
- **Right Section**: Status + Actions (max 3 buttons)

### 2. Icon Standards
- **Header Icons**: `h-5 w-5`
- **Button Icons**: `h-4 w-4` 
- **Summary Cards**: `h-8 w-8`
- **Empty State**: `h-12 w-12`

### 3. Button Standards
- **Icon Only**: `size="icon"` dengan `className="h-8 w-8"`
- **Small Buttons**: `size="sm"`
- **Action Buttons**: Icon + Text dengan `mr-2` untuk spacing

### 4. Summary Cards
- **Structure**: Card > CardHeader > CardContent
- **Grid**: `grid grid-cols-1 md:grid-cols-4 gap-4`
- **Items**: Center-aligned dengan icon, value, dan label
- **Styling**: `text-center p-4 bg-muted/50 rounded-lg`

### 5. Data Tables
- **Container**: Wrapped dalam Card component
- **Actions**: Right-aligned dengan `text-right`
- **Empty State**: Centered dengan icon, title, description, dan action button
- **Pagination**: Dengan result info dan navigation controls

### 6. Search Components
- **Position**: Below header dengan `px-4 py-2 border-b`
- **Container**: `relative max-w-sm`
- **Icon**: `absolute left-2 top-2.5 h-4 w-4`
- **Input**: `pl-8` untuk icon spacing

## Color & Variant Standards

### Colors
- **Primary**: Default actions, accent colors
- **Muted**: Secondary backgrounds, disabled states
- **Destructive**: Delete actions, error states
- **Outline**: Secondary buttons, borders

### Variants
- **Buttons**: `default`, `outline`, `destructive`, `secondary`
- **Badges**: `default`, `secondary`, `outline`, `destructive`

## Spacing Standards

### Layout Spacing
- **Header**: `h-16 px-4`
- **Content**: `p-4 space-y-4`
- **Search**: `px-4 py-2`
- **Cards**: `gap-4` untuk grid, `space-y-4` untuk vertical

### Component Spacing
- **Icon + Text**: `mr-2` atau `gap-2`
- **Button Groups**: `gap-2`
- **Form Fields**: `space-y-2` atau `space-y-4`

## Typography Standards

- **Page Title**: `text-lg font-semibold`
- **Card Title**: `CardTitle` component (default styling)
- **Section Headings**: `text-sm font-medium`
- **Help Text**: `text-xs text-muted-foreground`
- **Table Headers**: `TableHead` component
- **Empty State Title**: `text-lg font-semibold`

## Responsive Design

### Grid Breakpoints
- **Summary Cards**: `grid-cols-1 md:grid-cols-4`
- **Form Fields**: `grid-cols-1 md:grid-cols-2`
- **Search**: `max-w-sm` untuk consistent width

### Mobile Considerations
- Sidebar triggers are properly sized
- Search inputs are appropriately constrained
- Card grids stack on mobile
- Table actions remain accessible

## Implementation Status

### ✅ Control Pages (Completed)
- `/control/logic` - Automation logic control
- `/control/manual` - Manual device control
- `/control/schedule` - Scheduled control
- `/control/value` - Value-based automation
- `/control/voice` - Voice control

### ✅ Payload Pages (Completed)
- `/payload/static` - Static payload management
- `/payload/dynamic` - Dynamic payload configuration

### 🔄 Remaining Pages
- Device pages (`/devices/*`)
- Network pages (`/network/*`)
- Settings pages (`/settings/*`)

## Best Practices

1. **Consistency**: Always follow the established patterns
2. **Accessibility**: Use proper labels and ARIA attributes
3. **Performance**: Implement proper pagination and virtualization
4. **Responsiveness**: Test on mobile and tablet viewports
5. **Error Handling**: Provide meaningful error states and messages
6. **Loading States**: Show appropriate loading indicators
7. **Empty States**: Provide helpful empty state messages with actions

## Migration Guidelines

When updating existing pages:

1. Replace custom header with standard header pattern
2. Wrap content in SidebarInset
3. Add summary cards using the standard grid
4. Wrap tables in Card components
5. Update pagination to include result info
6. Standardize icon sizes and button variants
7. Ensure consistent spacing and typography