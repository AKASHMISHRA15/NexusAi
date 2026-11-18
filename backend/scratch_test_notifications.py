import asyncio
try:
    from winsdk.windows.ui.notifications.management import UserNotificationListener
    from winsdk.windows.foundation import EventRegistrationToken
    
    print("UserNotificationListener available.")
    
    async def test():
        listener = UserNotificationListener.get_current()
        access_status = await listener.request_access_async()
        print(f"Access status: {access_status}")
    
    asyncio.run(test())
except ImportError as e:
    print(f"ImportError: {e}")
