// Define function schemas for OpenAI function calling
export const functionDefinitions = [
  {
    name: 'get_schedule_items',
    description: 'Retrieve the user\'s schedule items',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_ideas',
    description: 'Retrieve the user\'s ideas',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_habits',
    description: 'Retrieve the user\'s habits',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_user_bio',
    description: 'Retrieve the user\'s biography/profile information',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'update_user_bio',
    description: 'Update the user\'s biography based on new information',
    parameters: {
      type: 'object',
      properties: {
        bio: {
          type: 'string',
          description: 'The updated biography text for the user'
        }
      },
      required: [
        'bio'
      ]
    }
  },
  {
    name: 'create_schedule_item',
    description: 'Create a new schedule item or event for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the schedule item'
        },
        description: {
          type: 'string',
          description: 'Optional description of the schedule item'
        },
        date: {
          type: 'string',
          description: 'Date in format YYYY-MM-DD'
        },
        start_time: {
          type: 'string',
          description: 'Start time in format HH:MM or h:MM AM/PM'
        },
        end_time: {
          type: 'string',
          description: 'End time in format HH:MM or h:MM AM/PM. If not provided, defaults to 1 hour after start time'
        },
        priority: {
          type: 'string',
          enum: [
            'low',
            'medium',
            'high'
          ],
          description: 'Priority level of the task'
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event'
        },
        recurrence_rule: {
          type: 'string',
          description: 'iCal RRULE string like "FREQ=DAILY;INTERVAL=1"'
        },
        recurring: {
          type: 'boolean',
          description: 'DEPRECATED: Whether this is a recurring event. Use recurrence_rule instead.'
        },
        frequency: {
          type: 'string',
          description: 'DEPRECATED: Frequency for recurring events (daily/weekly/monthly/yearly). Use recurrence_rule instead.'
        },
        interval: {
          type: 'number',
          description: 'DEPRECATED: Interval for recurring events. Use recurrence_rule instead.'
        },
        repeat_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'DEPRECATED: Days of the week for recurring events. Use recurrence_rule instead.'
        }
      },
      required: [
        'title',
        'start_time',
        'end_time'
      ]
    }
  },
  {
    name: 'update_schedule_item',
    description: 'Update an existing schedule item',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the schedule item to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        date: {
          type: 'string',
          description: 'Updated date in format YYYY-MM-DD'
        },
        start_time: {
          type: 'string',
          description: 'Updated start time in format HH:MM or h:MM AM/PM'
        },
        end_time: {
          type: 'string',
          description: 'Updated end time in format HH:MM or h:MM AM/PM'
        },
        priority: {
          type: 'string',
          enum: [
            'low',
            'medium',
            'high'
          ],
          description: 'Updated priority level'
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event'
        },
        recurrence_rule: {
          type: 'string',
          description: 'iCal RRULE string like "FREQ=DAILY;INTERVAL=1"'
        },
        recurring: {
          type: 'boolean',
          description: 'DEPRECATED: Whether this is a recurring event. Use recurrence_rule instead.'
        },
        frequency: {
          type: 'string',
          description: 'DEPRECATED: Frequency for recurring events. Use recurrence_rule instead.'
        },
        interval: {
          type: 'number',
          description: 'DEPRECATED: Interval for recurring events. Use recurrence_rule instead.'
        },
        repeat_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'DEPRECATED: Days of the week for recurring events. Use recurrence_rule instead.'
        }
      },
      required: [
        'id',
        'start_time',
        'end_time'
      ]
    }
  },
  {
    name: 'create_idea',
    description: 'Create a new idea for the user',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The content of the idea'
        }
      },
      required: [
        'content'
      ]
    }
  },
  {
    name: 'update_idea',
    description: 'Update an existing idea',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the idea to update'
        },
        content: {
          type: 'string',
          description: 'Updated content'
        }
      },
      required: [
        'id',
        'content'
      ]
    }
  },
  {
    name: 'create_habit',
    description: 'Create a new habit for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the habit'
        },
        description: {
          type: 'string',
          description: 'Description of the habit'
        },
        frequency: {
          type: 'string',
          description: 'How often the habit should be performed (e.g., "daily", "weekly")'
        },
        type: {
          type: 'string',
          description: 'Type of habit (e.g., "health", "productivity")'
        },
        target_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Days of the week for the habit (e.g., ["Monday", "Wednesday", "Friday"])'
        }
      },
      required: [
        'title'
      ]
    }
  },
  {
    name: 'update_habit',
    description: 'Update an existing habit',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the habit to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        frequency: {
          type: 'string',
          description: 'Updated frequency'
        },
        type: {
          type: 'string',
          description: 'Updated type'
        },
        streak: {
          type: 'number',
          description: 'Updated streak count'
        },
        target_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Updated days of the week for the habit'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_schedule_item',
    description: 'Delete a schedule item',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the schedule item to delete'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_idea',
    description: 'Delete an idea',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the idea to delete'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_habit',
    description: 'Delete a habit',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the habit to delete'
        }
      },
      required: [
        'id'
      ]
    }
  }
]; 