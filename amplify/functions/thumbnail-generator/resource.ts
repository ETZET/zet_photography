import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect, AnyPrincipal } from 'aws-cdk-lib/aws-iam';

export class ThumbnailGeneratorStack {
  public readonly function: lambda.Function;

  constructor(scope: Construct, _id: string) {
    // Define the Lambda function
    this.function = new lambda.Function(scope, 'ThumbnailGeneratorFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('./amplify/functions/thumbnail-generator'),
      layers: [
        // Use AWS-provided Pillow layer for PIL functionality
        lambda.LayerVersion.fromLayerVersionArn(
          scope,
          'PillowLayer',
          'arn:aws:lambda:us-east-2:770693421928:layer:Klayers-p311-Pillow:6'
        )
      ],
      functionName: 'ThumbnailGeneratorFunction',
      description: 'Generates thumbnails for uploaded images',
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: {
        // Environment variables will be added in backend.ts
      },
    });

    // Add resource policy to allow Lambda invocation from any principal
    // This allows both authenticated and unauthenticated users to invoke the function
    this.function.addPermission('AllowPublicInvoke', {
      principal: new AnyPrincipal(),
      action: 'lambda:InvokeFunction',
    });

    // Output the Lambda function ARN
    new CfnOutput(scope, 'ThumbnailGeneratorFunctionArn', {
      value: this.function.functionArn,
      exportName: 'ThumbnailGeneratorFunctionArn',
    });
  }
}