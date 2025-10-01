import { toast } from "sonner";

/**
 * Utility functions to replace SweetAlert2 with toast notifications
 * Use these instead of Swal.fire()
 */

export const showToast = {
  /**
   * Success toast - replaces Swal.fire({ icon: 'success', ... })
   */
  success: (title: string, description?: string) => {
    toast.success(title, {
      description,
    });
  },

  /**
   * Error toast - replaces Swal.fire({ icon: 'error', ... })
   */
  error: (title: string, description?: string) => {
    toast.error(title, {
      description,
    });
  },

  /**
   * Warning toast - replaces Swal.fire({ icon: 'warning', ... })
   */
  warning: (title: string, description?: string) => {
    toast.warning(title, {
      description,
    });
  },

  /**
   * Info toast - replaces Swal.fire({ icon: 'info', ... })
   */
  info: (title: string, description?: string) => {
    toast.info(title, {
      description,
    });
  },

  /**
   * Loading toast - for async operations
   */
  loading: (title: string, description?: string) => {
    return toast.loading(title, {
      description,
    });
  },

  /**
   * Promise toast - for async operations with auto state management
   */
  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, options);
  },

  /**
   * Custom toast with action button
   */
  withAction: (
    title: string,
    description: string,
    actionLabel: string,
    action: () => void
  ) => {
    toast(title, {
      description,
      action: {
        label: actionLabel,
        onClick: action,
      },
    });
  },

  /**
   * Dismiss specific toast
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Update existing toast (for loading states)
   */
  update: (toastId: string | number, options: any) => {
    // Sonner doesn't have direct update, so dismiss and create new
    toast.dismiss(toastId);
    return toast(options.title, options);
  },
};

/**
 * Migration helpers for common Swal patterns
 */

// Replaces: Swal.fire({ icon: 'success', title: 'Success', text: 'Message' })
export const successToast = (message: string, title: string = "Success") => {
  showToast.success(title, message);
};

// Replaces: Swal.fire({ icon: 'error', title: 'Error', text: 'Message' })
export const errorToast = (message: string, title: string = "Error") => {
  showToast.error(title, message);
};

// Replaces: Swal.fire({ icon: 'warning', title: 'Warning', text: 'Message' })
export const warningToast = (message: string, title: string = "Warning") => {
  showToast.warning(title, message);
};

// Replaces: Swal.fire({ icon: 'info', title: 'Info', text: 'Message' })
export const infoToast = (message: string, title: string = "Info") => {
  showToast.info(title, message);
};