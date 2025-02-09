# HomeVoiceNote

This web application allows recording audio from a mobile device or browser and playing it on a selected smart speaker through Home Assistant.

HomeVoiceNote was created using Claude 3.5 Sonnet & Cline with human supervision.

## Setup Instructions

### 1. AWS S3 Setup

1. Create an S3 bucket:
   - Go to AWS Console > S3
   - Create a new bucket
   - Note down the bucket name and region

2. Configure CORS for the bucket:
   - Select your bucket
   - Go to Permissions tab
   - Edit CORS configuration and add:
   ```json
   [
       {
           "AllowedHeaders": [
               "*"
           ],
           "AllowedMethods": [
               "PUT",
               "POST",
               "GET",
               "HEAD"
           ],
           "AllowedOrigins": [
               "*"
           ],
           "ExposeHeaders": [
               "ETag"
           ],
           "MaxAgeSeconds": 3000
       }
   ]
   ```

   Note: Replace "*" in AllowedOrigins with your actual domain in production.

3. Create IAM User:
   - Go to AWS Console > IAM
   - Create a new policy with the following permissions:
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": [
                   "s3:PutObject",
                   "s3:PutObjectAcl"
               ],
               "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
           }
       ]
   }
   ```
   - Create a new user
   - Attach the policy to the user
   - Create access key and secret
   - Note down the access key and secret

### 2. Home Assistant Setup

1. Create Long-Lived Access Token:
   - Go to your Home Assistant profile
   - Scroll to the bottom
   - Create a new long-lived access token
   - Note down the token

2. Find Speaker Entity ID:
   - Go to Developer Tools > States
   - Look for your media player entity
   - Note down the entity ID (e.g., media_player.living_room)

If you want to host this app files in the same bucket as audio files go to `/homeassistant/configuration.yaml` and add 

```
http:
    cors_allowed_origins:
        - https://s3.AWS-REGION.amazonaws.com
```

### 3. Application Usage

The application needs to be accessed with specific URL parameters containing your configuration:

```
https://your-domain.com/index.html?s3_bucket=your-bucket&s3_region=us-east-1&s3_key=AKIAXXXXXXXX&s3_secret=XXXXXXXX&ha_url=http://your-ha-instance:8123&ha_token=XXXXXXXX&speaker_id=media_player.living_room&speaker_name=LivingRoom
```

**Be careful when adding parameters with special characters, such as the + sign in s3_secret. Use URL encoding to convert the value to the correct format.**
Without proper URL encoding you may get `SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided` error.

Required URL Parameters:
- s3_bucket: Your S3 bucket name
- s3_region: AWS region of your bucket
- s3_key: AWS access key
- s3_secret: AWS secret key
- ha_url: Your Home Assistant URL (including port if needed)
- ha_token: Long-lived access token from Home Assistant
- speaker_id: Entity ID of your media player
- speaker_name: User-frendly speaker name

## Security Considerations

- Keep your URL with credentials private and secure
- Consider using a proxy service to avoid exposing credentials in URL
- Use HTTPS to protect data in transit
- Regularly rotate your access tokens and keys
