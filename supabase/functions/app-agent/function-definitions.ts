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
    name: 'get_goals',
    description: 'Retrieve the user\'s goals',
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
        type: {
          type: 'string',
          enum: ['task', 'event'],
          description: 'Whether this is a task or an event',
          default: 'task'
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
        type: {
          type: 'string',
          enum: ['task', 'event'],
          description: 'Whether this is a task or an event'
        }
      },
      required: [
        'id'
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
        'id'
      ]
    }
  },
  {
    name: 'create_goal',
    description: 'Create a new goal for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the goal'
        },
        description: {
          type: 'string',
          description: 'Description of the goal'
        },
        target_date: {
          type: 'string',
          description: 'Target date for achieving the goal in format YYYY-MM-DD'
        },
        progress: {
          type: 'integer',
          description: 'Current progress as a percentage (0-100)'
        },
        category: {
          type: 'string',
          description: 'Category of the goal (e.g. "Career", "Health", "Education", "Personal", "Finance")'
        }
      },
      required: [
        'title',
        'target_date'
      ]
    }
  },
  {
    name: 'update_goal',
    description: 'Update an existing goal',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the goal to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        target_date: {
          type: 'string',
          description: 'Updated target date in format YYYY-MM-DD'
        },
        progress: {
          type: 'integer',
          description: 'Updated progress percentage (0-100)'
        },
        category: {
          type: 'string',
          description: 'Updated category'
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
        },
        title: {
          type: 'string',
          description: 'Title of the schedule item to delete (for confirmation)'
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
        },
        content: {
          type: 'string',
          description: 'Content of the idea to delete (for confirmation)'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_goal',
    description: 'Delete a goal',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the goal to delete'
        },
        title: {
          type: 'string',
          description: 'Title of the goal to delete (for confirmation)'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'search_web_resources',
    description: 'Search the web for relevant resources based on user context',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query based on user context'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'create_resource',
    description: 'Create a new resource for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the resource'
        },
        url: {
          type: 'string',
          description: 'URL of the resource'
        },
        description: {
          type: 'string',
          description: 'Description of the resource'
        },
        category: {
          type: 'string',
          enum: ['Article', 'Video', 'Course', 'Tool'],
          description: 'Category of the resource'
        },
        relevance_score: {
          type: 'number',
          description: 'Relevance score from 0-100',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['title', 'url', 'description', 'category', 'relevance_score']
    }
  },
  {
    name: 'get_resources',
    description: 'Retrieve the user\'s resources',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'update_resource',
    description: 'Update an existing resource',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the resource to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        url: {
          type: 'string',
          description: 'Updated URL'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        category: {
          type: 'string',
          enum: ['Article', 'Video', 'Course', 'Tool'],
          description: 'Updated category'
        },
        relevance_score: {
          type: 'number',
          description: 'Updated relevance score from 0-100',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_resource',
    description: 'Delete a resource',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the resource to delete'
        }
      },
      required: ['id']
    }
  }
]; 