import { OperatorNode } from '@operator/operator-node';
import { createRequest, createResponse, MockResponse } from 'node-mocks-http';
import { Response } from 'express';
import { OperatorClient } from '@client/operator-client';
import { GetIdsPrefsResponse, Signature, Timestamp } from '@core/model';
import { id, preferences } from '../fixtures/operator-fixtures';
import { NodeError, NodeErrorType } from '@core/errors';
import { OperatorUtils } from '../utils/operator-utils';

describe('Operator Node', () => {
  let operatorNode: OperatorNode;
  let response: MockResponse<Response>;
  const nextMock = jest.fn();
  const operatorHost = 'example.onekey.network';
  const publicKeyProviderAlwaysSucceeds = () => Promise.resolve({ verify: () => true });
  const client = new OperatorClient(
    operatorHost,
    'paf.read-write.com',
    `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxrHgVC3uFlEqnqab
cPqLNBFbMbt1tAPsvKy8DBV2m+ChRANCAARSdqvCnSBRmCNv1+xg0tw2t100pXmH
j9Z8xExWHcciqiO3csiy9RCKDWub1mRw3H4gdlWEMz6GyjaxeUaMX3E5
-----END PRIVATE KEY-----`,
    publicKeyProviderAlwaysSucceeds
  );
  const existingPafCookies = {
    paf_identifiers: JSON.stringify([id]),
    paf_preferences: JSON.stringify(preferences),
  };

  /**
   * Request used by the operator client, to build operator requests
   */
  const clientRequest = createRequest({
    headers: {
      origin: 'www.read-write.com',
    },
  });

  /**
   * Do basic assertions on a source
   * @param data
   */
  const basicAssertSignature = (data: { timestamp: Timestamp; signature: Signature }) => {
    expect(Number(data.timestamp)).not.toBeNaN();
    expect(data.signature).not.toBe('');
  };

  beforeEach(() => {
    operatorNode = OperatorUtils.buildOperator(OperatorUtils.getSuccessfulJsonValidatorMock(), () =>
      Promise.resolve({ verify: () => true })
    );
    response = createResponse();
  });
  describe('restRead', () => {
    const url = client.getReadResponse(clientRequest);

    test('should return new ID for unknown user', async () => {
      const request = createRequest({
        method: 'GET',
        headers: {
          origin: 'www.read-write.com',
        },
        url,
      });

      await operatorNode.restReadIdsAndPreferences(request, response, nextMock);

      expect(response._getStatusCode()).toEqual(200);
      expect(nextMock).toHaveBeenCalledWith();
      // Check data
      const data = response._getJSONData() as GetIdsPrefsResponse;
      basicAssertSignature(data);
      expect(data.body.preferences).toBeUndefined();
      expect(data.body.identifiers).toHaveLength(1);
      const identifier = data.body.identifiers[0];
      basicAssertSignature(identifier.source);
      expect(identifier.source.domain).toEqual(operatorHost);
      expect(identifier.persisted).toEqual(false);

      // 3PC test cookie
      expect(response.cookies['paf_test_3pc'].value).not.toBe('');
    });
    test('should return existing cookies for known user', async () => {
      const request = createRequest({
        method: 'GET',
        headers: {
          origin: 'www.read-write.com',
        },
        cookies: existingPafCookies,
        url,
      });

      await operatorNode.restReadIdsAndPreferences(request, response, nextMock);

      expect(response._getStatusCode()).toEqual(200);
      expect(nextMock).toHaveBeenCalledWith();
      // Check data
      const data = response._getJSONData() as GetIdsPrefsResponse;
      basicAssertSignature(data);
      expect(data.body.preferences).toEqual(preferences);
      expect(data.body.identifiers).toEqual([id]);

      // 3PC test cookie
      expect(response.cookies['paf_test_3pc'].value).not.toBe('');
    });
  });

  describe('permissions', () => {
    const unauthorizedClient = new OperatorClient(
      operatorHost,
      'paf.unauthorized.com',
      `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxrHgVC3uFlEqnqab
cPqLNBFbMbt1tAPsvKy8DBV2m+ChRANCAARSdqvCnSBRmCNv1+xg0tw2t100pXmH
j9Z8xExWHcciqiO3csiy9RCKDWub1mRw3H4gdlWEMz6GyjaxeUaMX3E5
-----END PRIVATE KEY-----`,
      publicKeyProviderAlwaysSucceeds
    );
    const readOnlyClient = new OperatorClient(
      operatorHost,
      'paf.read-only.com',
      `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxrHgVC3uFlEqnqab
cPqLNBFbMbt1tAPsvKy8DBV2m+ChRANCAARSdqvCnSBRmCNv1+xg0tw2t100pXmH
j9Z8xExWHcciqiO3csiy9RCKDWub1mRw3H4gdlWEMz6GyjaxeUaMX3E5
-----END PRIVATE KEY-----`,
      publicKeyProviderAlwaysSucceeds
    );
    const writeOnlyClient = new OperatorClient(
      operatorHost,
      'paf.write-only.com',
      `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxrHgVC3uFlEqnqab
cPqLNBFbMbt1tAPsvKy8DBV2m+ChRANCAARSdqvCnSBRmCNv1+xg0tw2t100pXmH
j9Z8xExWHcciqiO3csiy9RCKDWub1mRw3H4gdlWEMz6GyjaxeUaMX3E5
-----END PRIVATE KEY-----`,
      publicKeyProviderAlwaysSucceeds
    );
    const cases = [
      {
        client: unauthorizedClient,
        name: 'unauthorized',
        authorized: false,
      },
      {
        client: readOnlyClient,
        name: 'read-only',
        authorized: true,
      },
      {
        client: writeOnlyClient,
        name: 'write-only',
        authorized: false,
      },
    ];

    test.each(cases)('$name client should be allowed to read: $authorized', async ({ client, authorized, name }) => {
      const url = client.getReadResponse(clientRequest);
      const request = createRequest({
        method: 'GET',
        headers: {
          origin: `www.${name}.com`, // Doesn't really matter
        },
        cookies: existingPafCookies,
        url,
      });

      await operatorNode.restReadIdsAndPreferences(request, response, nextMock);

      // TODO later these errors will be more specific
      const error: NodeError = {
        type: NodeErrorType.UNKNOWN_ERROR,
        details: '',
      };

      if (authorized) {
        expect(response._getStatusCode()).toEqual(200);
        expect(nextMock).toHaveBeenCalledWith();
        const data = response._getJSONData() as GetIdsPrefsResponse;
        expect(data.body.identifiers).toHaveLength(1);
      } else {
        expect(response._getStatusCode()).toEqual(400);
        expect(nextMock).toHaveBeenCalledWith(error);

        const data = response._getJSONData() as NodeError;
        expect(data).toEqual(error);
      }
    });
  });
  afterEach(() => {
    nextMock.mockClear();
  });
});
