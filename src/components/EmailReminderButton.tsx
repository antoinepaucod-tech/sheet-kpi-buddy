import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell } from 'lucide-react';
import { EmailPreferences } from './EmailPreferences';

export const EmailReminderButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rappels Hebdomadaires</DialogTitle>
        </DialogHeader>
        <EmailPreferences />
      </DialogContent>
    </Dialog>
  );
};
